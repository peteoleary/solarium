import React, {useCallback, useContext, useEffect, useState} from "react";
import {useWallet} from "../wallet/wallet";
import {Message, Channel} from "solarium-js";
import {useConnection} from "../web3/connection";
import {useIdentity} from "../identity";
import {postToChannel, readChannel} from "./solarium";
import {useLocalStorageState} from "../storage";
import {
  AddressBookConfig,
  AddressBookManager,
  emptyAddressBookConfig,
  publicChannelConfigByName
} from "./addressBook";
import {DEFAULT_CHANNEL} from "../constants";

type ChannelProps = {
  messages: Message[],
  post: (message: string) => Promise<void>,
  channel?: Channel
  setCurrentChannel: (channel: Channel) => void
  addressBook: AddressBookManager | undefined
  joinPublicChannel: () => Promise<void>,
  initialised: boolean
}

const ChannelContext = React.createContext<ChannelProps>({
  post: (): Promise<void> => Promise.resolve(undefined),
  messages: [],
  setCurrentChannel: () => {},
  addressBook: undefined,
  joinPublicChannel: async () => {},
  initialised: false
});
export function ChannelProvider({ children = null as any }) {
  const {wallet, connected} = useWallet();
  const connection = useConnection();
  const { ready: identityReady, decryptionKey, did, document} = useIdentity();
  const [channel, setChannel] = useState<Channel>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [addressBook, setAddressBook] = useState<AddressBookManager>();
  const [currentChannelInState, setCurrentChannelInState] = useLocalStorageState<string>('channel');
  const [addressBookStore, setAddressBookStore] = useLocalStorageState<AddressBookConfig>('addressBook', emptyAddressBookConfig);
  const [solariumInitialised, setSolariumInitialised] = useLocalStorageState<boolean>('solariumInitialised');

  const setCurrentChannel = useCallback(async (newChannel: Channel | undefined) => {
    if (!newChannel || newChannel.address.toBase58() === currentChannelInState) return;
    setMessages([]);
    setCurrentChannelInState(newChannel.address.toBase58());
    setChannel(newChannel)
  }, [currentChannelInState, setChannel, setCurrentChannelInState]);

  const joinPublicChannel = useCallback(() => {
    if (!addressBook) throw new Error("Load address book first");

    const defaultChannel = addressBook.getChannelByName(DEFAULT_CHANNEL);

    if (!defaultChannel) {
      // not in lobby- try to join it.
      const lobbyConfig = publicChannelConfigByName(DEFAULT_CHANNEL);

      if (!lobbyConfig) {
        throw new Error(`No channel named ${DEFAULT_CHANNEL} found in config`)
      }

      return addressBook.joinChannel(lobbyConfig)
    } // else already in the lobby
    return Promise.resolve(defaultChannel)
  },  [addressBook])

  const joinPublicChannelAndSetDefault = useCallback(() =>
    joinPublicChannel().then(async () => {
      if (!currentChannelInState && addressBook) {
        await setCurrentChannel(addressBook.getChannelByName(DEFAULT_CHANNEL));
        setSolariumInitialised(true)
      }
    })
  , [joinPublicChannel, currentChannelInState, addressBook, setCurrentChannel])

  // load addressbook when identity ready
  useEffect(() => {
    if (!wallet || !connected || !identityReady || !did || !decryptionKey || addressBook) return;

    AddressBookManager
      .load(addressBookStore, connection, wallet, did, decryptionKey, setAddressBookStore)
      .then(setAddressBook)
  }, [
    wallet, connected, connection,
    addressBookStore,
    identityReady, did, decryptionKey,
    document, addressBook
  ]);

  useEffect(() => {
    if (channel || !wallet || !connected || !identityReady || !addressBook) return;

    if (currentChannelInState) {
      const groupOrDirectChannel = addressBook.getGroupOrDirectChannelByAddress(currentChannelInState);

      if (groupOrDirectChannel) {
          setChannel(groupOrDirectChannel);
      }
    }
  }, [wallet, connected, addressBook, channel, setChannel, currentChannelInState, identityReady]);

  useEffect(() => {
    if (!wallet || !connected || !channel || !did || !decryptionKey) return;
    // subscribe to channel messages
    const subscription = readChannel(did, channel, decryptionKey).subscribe(message => {
      if (message) {
        // add message to local state if not empty
        setMessages(messages => [...messages, message]);
      } else {
        // clear messages when empty message received
        setMessages([]);
      }
    });

    // return unsubscribe method to execute when component unmounts
    return () => subscription.unsubscribe();
  }, [wallet, connected, channel, did, decryptionKey]);

  const post = useCallback((message: string) => {
      if (!wallet || !connected || !channel || !did || !decryptionKey) throw new Error("Posting unavailable.");
      return postToChannel(connection, wallet, channel, did, decryptionKey, message);
    },
    [connection, wallet, did, decryptionKey, channel, connected])

  return (
    <ChannelContext.Provider value={{
      messages,
      post,
      channel,
      setCurrentChannel,
      addressBook,
      joinPublicChannel: joinPublicChannelAndSetDefault,
      initialised: solariumInitialised
    }}>
      {children}
    </ChannelContext.Provider>
  );
}

export function useChannel():ChannelProps {
  const context = useContext(ChannelContext);
  return {
    messages: context.messages,
    post: context.post,
    channel: context.channel,
    setCurrentChannel: context.setCurrentChannel,
    addressBook: context.addressBook,
    joinPublicChannel: context.joinPublicChannel,
    initialised: context.initialised
  };
}
