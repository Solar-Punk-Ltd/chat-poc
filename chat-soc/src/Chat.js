import React, { useEffect, useState } from 'react';
import { Bee, Utils } from '@ethersphere/bee-js';
import './App.css';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
const STAMP = "733976cce45c4164ccfc3dda44d2c664256e90cadd808e57cdc63ffcfbe1bc1e"
//dev"b6a0a89edaf33580f9811a868eb5d8cbad400989110d9f10a7d2dfea0dfb688a";
const NODE_ADDRESS = "http://195.88.57.155";


export default function Chat() {
  const [convInput, setConvInput] = useState("");                     // This is just the html input, not considered ready value
  const [recInput, setRecInput] = useState("");                       // This is just the html input, not considered ready value
  const [conversationID, setConversationID] = useState("");           // This will be hashed to create the 'topic'
  const [recipientAddress, setRecipientAddress] = useState("");       // Address of the other person
  const [ourAddress, setOurAddress] = useState("");                   // Our Ethereum address
  const [signer, setSigner] = useState(null);                         // Signer that we will use to send new messages
  const [allMessages, setAllMessages] = useState([]);                 // All the messages
  const [newMessage, setNewMessage] = useState("");                   // New message to be sent
  const [buttonActive, setButtonActive] = useState(true);             // Deactivate button, while loading
  const [lastRefresh, setLastRefresh] = useState(null);               // Last refresh, unix timestamp
  const [elapsedSeconds, setElapsedSeconds] = useState("loading..."); // "loading..." or a number, in seconds

  useEffect(() => {
    loader();
  }, []);

  useEffect(() => {
    setAllMessages([]);
    setElapsedSeconds("loading...");
    if (ourAddress.length > 0) {
      readMessages();
      const intervalId = setInterval(readMessages, 9000);
      return () => clearInterval(intervalId);
    }
  }, [ourAddress, conversationID, recipientAddress]);

  useEffect(() => {
    if (allMessages.length > 0) {
      calculateSeconds()
      const refreshIntervalId = setInterval(calculateSeconds, 900);
      return () => clearInterval(refreshIntervalId);
    }
  }, [allMessages]);

  async function loader() {
    try {
      if (!window.ethereum) throw Error("You don't have Metamask!");

      const signer = await Utils.makeEthereumWalletSigner(window.ethereum);
      setSigner(signer);
      setOurAddress(`0x${toHexString(signer.address)}`);
      readMessages();

      const rec = localStorage.getItem('recipient');
      const convID = localStorage.getItem('conversationID');
      if (rec) setRecipientAddress(rec);
      if (convID) setConversationID(convID);

    } catch (error) {
      console.error("There was an error while connecting to Metamask: ", error);
    }
  }

  function toHexString(byteArray) {
    return Array.from(byteArray, function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('')
  }

  async function sendMessage() {
    setButtonActive(false);
    const bee = new Bee(`${NODE_ADDRESS}:1633`, signer);
    const sendMessagePromise = new Promise(async function(resolve, reject) {
      const message = {
        text: newMessage,
        timestamp: Date.now()
      }
  
      const result = await bee.setJsonFeed(STAMP, conversationID, message, { signer: signer, type: 'sequence' } );
      console.log("Result: ", result)
  
      //localStorage.setItem('recipient', recipientAddress);
      //localStorage.setItem('conversationID', conversationID);

      setButtonActive(true);
      if (result) resolve();
      else reject();
    });

    toast.promise(
      sendMessagePromise,
      {
        pending: "Sending message...",
        success: "Done.",
        error: "Error."
      }
    );
  }

  async function readMessages() {
    if (!buttonActive || ourAddress.length == 0 || recipientAddress.length == 0) { 
      return; // Going forward without these values would cause error
    };
    
    try {
      const bee = new Bee(`${NODE_ADDRESS}:1633`, signer);
      const topic = bee.makeFeedTopic(conversationID);
      console.log("Conversation: ", conversationID)
      const ourReader = bee.makeFeedReader('sequence', topic, ourAddress);
      const recipientReader = bee.makeFeedReader('sequence', topic, recipientAddress);
      let ourIndex = await getIndex(topic, ourAddress);
      let recipientIndex = await getIndex(topic, recipientAddress);
      if (ourIndex === -1 || recipientIndex === -1) {
        if (ourIndex === -1 && recipientIndex === -1) {
          // Wrong topic
          setElapsedSeconds("Empty conversation");
          setLastRefresh(new Date());
          return;
          //throw Error("Most likely the conversation name is not correct.");
        } else {
          // Wrong address
          setElapsedSeconds("No message from recipient");
          //setLastRefresh(new Date());
          //return;
          //throw Error("Most likely the address is not correct.");
        }
      }
      const ourList = [];
      const recipientList = [];
      const textEncoder = new TextDecoder();
  
      //localStorage.setItem('recipient', recipientAddress);
      //localStorage.setItem('conversationID', conversationID);
      
      // Read our feed
      for (let i = 0; i <= ourIndex; i++) {
          const ourResult = await ourReader.download({ index: i });
          const rawData = await bee.downloadData(ourResult.reference);
          const text = textEncoder.decode(rawData)
          const resultObj = JSON.parse(text);
          resultObj.address = ourAddress;
          ourList.push(resultObj);
      }
  
      // Read recipient's feed
      for (let i = 0; i <= recipientIndex; i++) {
          const recipientResult = await recipientReader.download({ index: i });
          const rawData = await bee.downloadData(recipientResult.reference);
          const text = textEncoder.decode(rawData)
          const resultObj = JSON.parse(text);
          resultObj.address = recipientAddress;
          recipientList.push(resultObj);
      }
  
      // Unify the 2 lists, pay attention to timestamps!
      const sortedAll = [...ourList, ...recipientList].sort((messageA, messageB) => {
        return messageA.timestamp - messageB.timestamp
      });
      setAllMessages(sortedAll);
      console.log("Final list: ", sortedAll); 
      const tstamp = new Date();
      setLastRefresh(tstamp);
      //resolve();
    } catch (error) {
      console.error("There was an error while trying to fetch the messages: ", error);
      toast.error("Error reading messages: ", error)
    }

  }

  async function getIndex(theTopic, theAddress) {
    try {
      const bee = new Bee(`${NODE_ADDRESS}:1633`, signer);
      const indexReader = bee.makeFeedReader('sequence', theTopic, theAddress);
      const result = await indexReader.download();
      return Number(result.feedIndex);
    } catch (error) {
      console.error("There was an error while fetching index, probably this feed does not exist: ", error);
      return -1;
    }
  }

  function calculateSeconds() {
    if (!lastRefresh) return;

    const currentTime = new Date();
    const seconds = Math.floor((currentTime - lastRefresh)/1000);
    setElapsedSeconds(seconds + " seconds ago");
  }

  const debouncedChangeConvId = debounce((value) => {
    setConversationID(value);
    localStorage.setItem('conversationID', value);
  }, 1200);
  
  const debouncedChangeRecipient = debounce((value) => {
    setRecipientAddress(value);
    localStorage.setItem('recipient', value);
  }, 1200);


  return (
    <div id="chatApp">
      <div id="messageBox">
        <ul id="messageList">
          {allMessages.map((message) => (
            <li key={message.timestamp} className={message.address == ourAddress ? "singleMessage firstParticipant" : "singleMessage secondParticipant"}>
              <p className="messageText">{message.text}</p>
              <div className="messageSender">
                <p>{message.address == ourAddress ? "You": "Recipient"}</p>
                <p>{new Date(message.timestamp).toLocaleString()}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div id="chatControls">
        <div id="addresses">
          <p>Your Ethereum address: {ourAddress}</p>
          <p>Recipient's Ethereum address: 
            <input 
              type={'text'} 
              placeholder={"Copy address here"}
              value={recInput}
              className="textInput"
              onChange={(e) => {
                setRecInput(e.target.value);
                debouncedChangeRecipient(e.target.value);
              }}
            />
          </p>
        </div>
        <div id="conversationSettings">
          <p>Conversation name:
          <input 
            type={'text'} 
            placeholder={"topic-42"} 
            className="textInput"
            value={convInput} 
            onChange={(e) => {
              setConvInput(e.target.value);
              debouncedChangeConvId(e.target.value);
            }}
          />
          </p>
          <p>
            {"Last Refresh: "}{elapsedSeconds}
          </p>
        </div>
        <div id="sendMessageLine">
          <textarea 
            value={newMessage}
            className="flexGrow messageToSend"
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button disabled={!buttonActive} onClick={sendMessage}>Send</button>
        </div>
      </div>
          <button disabled={!buttonActive} onClick={readMessages}>Read</button>
    </div>
  )
}
